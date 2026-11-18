package com.coffeeshop.tableservice.config;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Returns the reason of errors the service raises on purpose (e.g. "Số bàn 1 đã có trong chi nhánh
 * này") as {@code message}, which the frontend shows. Spring's default body drops it. Other
 * exceptions keep the default handling, so internal details (SQL, stack) are not exposed.
 */
@RestControllerAdvice
public class ApiErrorHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", OffsetDateTime.now().toString());
        body.put("status", ex.getStatusCode().value());
        body.put("message", ex.getReason() != null ? ex.getReason() : "");
        return ResponseEntity.status(ex.getStatusCode()).body(body);
    }
}
