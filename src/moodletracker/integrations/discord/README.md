# Integração Discord (fase futura)

Dois papéis, ambos sem alterar o core:

1. **Notificações (saída)**: `DiscordNotifier` implementa `integrations.notifier.Notifier`. Ele recebe
   `PipelineEvent` (`item_new`, `item_completed`, `item_failed`, `run_finished`) e posta um embed no canal
   da disciplina (mapa `course → channel_id` em configuração). Basta registrá-lo em `build_notifiers()`.
2. **Comandos (entrada)**: um processo separado (`moodletracker discord`) com `discord.py` consome a
   **mesma API HTTP** da web UI (`/api/items`, `/api/items/{id}/review`, `/api/pipeline/run` e futuramente `/api/ask`),
   e nunca importa o banco diretamente. Isso mantém o bot desacoplado e deployável à parte.

Configuração prevista: `MT_DISCORD_TOKEN`, `MT_DISCORD_GUILD_ID` e `MT_DISCORD_COURSE_CHANNELS` (JSON).
