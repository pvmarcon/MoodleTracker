from __future__ import annotations

import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from moodletracker.api.app import create_app
from moodletracker.container import build_container
from moodletracker.domain.models import RunTrigger

pytestmark = pytest.mark.db


@pytest.fixture
def client(clean_db: str, inbox: Path, make_settings):  # type: ignore[no-untyped-def]
    settings = make_settings(database_url=clean_db)
    container = build_container(settings)
    container.pipeline().run(RunTrigger.CLI)
    app = create_app(settings, container=container, start_scheduler=False)
    with TestClient(app) as c:
        yield c
    container.close()


def test_health_stats_courses(client: TestClient) -> None:
    h = client.get("/api/health").json()
    assert h["status"] == "ok" and h["database"]["embedding_dim"] == "8" and h["scheduler"]["mode"] == "on-demand"
    st = client.get("/api/stats").json()
    assert (
        st["stats"]["items"] == 3 and st["stats"]["by_stage"]["chunked"] == 3 and st["runs"][0]["status"] == "succeeded"
    )
    courses = {c["name"]: c["items"] for c in client.get("/api/courses").json()}
    assert courses == {"Banco de Dados": 2, "Engenharia de Software": 1}


def test_items_filters_and_detail(client: TestClient) -> None:
    all_items = client.get("/api/items").json()
    assert all_items["total"] == 3
    course_id = next(c["id"] for c in client.get("/api/courses").json() if c["name"] == "Banco de Dados")
    assert client.get(f"/api/items?course_id={course_id}").json()["total"] == 2
    assert client.get("/api/items?item_type=pptx").json()["total"] == 1
    assert client.get("/api/items?q=requisitos").json()["total"] == 1
    assert client.get("/api/items?status=failed").json()["total"] == 0
    assert client.get("/api/items?stage=bogus").status_code == 422

    pptx = client.get("/api/items?item_type=pptx").json()["items"][0]
    assert pptx["stage"] == "chunked" and pptx["stage_index"] == 3
    detail = client.get(f"/api/items/{pptx['id']}").json()
    assert len(detail["documents"]) == 3 and detail["chunks"] > 0 and detail["stages"][0] == "discovered"
    doc = client.get(f"/api/documents/{detail['documents'][1]['id']}").json()
    assert doc["frontmatter"]["item_type"] == "pptx" and doc["frontmatter"]["course"] == "Banco de Dados"
    assert "Notas do professor" in doc["markdown"]
    assert client.get("/api/items/9999").status_code == 404


def test_review_and_events_feed(client: TestClient) -> None:
    item = client.get("/api/items").json()["items"][0]
    r = client.patch(f"/api/items/{item['id']}/review", json={"status": "needs_changes", "note": "faltou o slide 4"})
    assert r.status_code == 200 and r.json()["review_status"] == "needs_changes"
    assert client.get("/api/items?review_status=needs_changes").json()["total"] == 1
    assert client.patch(f"/api/items/{item['id']}/review", json={"status": "nope"}).status_code == 422
    feed = client.get("/api/events?limit=5").json()
    assert feed[0]["kind"] == "item_reviewed" and feed[0]["item_title"] == item["title"]
    older = client.get(f"/api/events?limit=5&before_id={feed[-1]['id']}").json()
    assert all(e["id"] < feed[-1]["id"] for e in older)


def test_manual_trigger_and_reprocess(client: TestClient) -> None:
    item = client.get("/api/items").json()["items"][0]
    assert client.post(f"/api/items/{item['id']}/reprocess").json()["accepted"] is True
    deadline = time.time() + 10
    while time.time() < deadline:
        if client.get(f"/api/items/{item['id']}").json()["item"]["status"] == "completed":
            break
        time.sleep(0.1)
    assert client.get(f"/api/items/{item['id']}").json()["item"]["status"] == "completed"
    assert client.post("/api/pipeline/run").status_code == 202


def test_ui_is_served(client: TestClient) -> None:
    html = client.get("/")
    assert html.status_code == 200 and "MoodleTracker" in html.text
    assert client.get("/static/app.js").status_code == 200
