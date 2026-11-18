package com.coffeeshop.tableservice.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ApiErrorHandlerTest {

    @Test
    void returnsTheReasonAsMessage() {
        ResponseEntity<Map<String, Object>> response = new ApiErrorHandler().handleResponseStatus(
                new ResponseStatusException(HttpStatus.CONFLICT, "Số bàn 1 đã có trong chi nhánh này"));

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals(409, response.getBody().get("status"));
        assertEquals("Số bàn 1 đã có trong chi nhánh này", response.getBody().get("message"));
    }
}
