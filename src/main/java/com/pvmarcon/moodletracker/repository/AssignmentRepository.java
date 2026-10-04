package com.pvmarcon.moodletracker.repository;

import com.pvmarcon.moodletracker.model.Assignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AssignmentRepository extends JpaRepository<Assignment, Long> {
    Optional<Assignment> findByLinkId(String linkId);
}
