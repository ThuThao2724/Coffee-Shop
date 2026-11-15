package com.coffeeshop.tableservice.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TableAuthFilterTest {

    private static final String SECRET = "test-jwt-secret-with-at-least-32-chars";
    private static final String INTERNAL = "test-internal-token-0123456789";

    private TableAuthFilter filter(String jwtSecret, String internalToken) {
        TableAuthFilter filter = new TableAuthFilter();
        ReflectionTestUtils.setField(filter, "jwtSecret", jwtSecret);
        ReflectionTestUtils.setField(filter, "internalServiceToken", internalToken);
        return filter;
    }

    /** HS256 token with the given key, padded to 32 bytes like the services do. */
    private static String token(byte[] key, String role) throws Exception {
        byte[] padded = key.length >= 32 ? key : java.util.Arrays.copyOf(key, 32);
        Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();
        String header = enc.encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payload = enc.encodeToString(("{\"sub\":\"u1\",\"role\":\"" + role + "\"}").getBytes(StandardCharsets.UTF_8));
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(padded, "HmacSHA256"));
        String signature = enc.encodeToString(mac.doFinal((header + "." + payload).getBytes(StandardCharsets.UTF_8)));
        return header + "." + payload + "." + signature;
    }

    private MockHttpServletResponse createTable(TableAuthFilter filter, String bearer) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/tables");
        request.addHeader("Authorization", "Bearer " + bearer);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        if (chain.getRequest() == null) {
            return response;
        }
        response.setStatus(299); // reached the controller
        return response;
    }

    @Test
    void refusesToStartWithABlankSecret() {
        assertThrows(IllegalStateException.class, () -> filter("", INTERNAL).requireSecrets());
        assertThrows(IllegalStateException.class, () -> filter("   ", INTERNAL).requireSecrets());
        assertThrows(IllegalStateException.class, () -> filter(SECRET, "").requireSecrets());
        filter(SECRET, INTERNAL).requireSecrets();
    }

    @Test
    void rejectsATokenSignedWithAnAllZeroKey() throws Exception {
        MockHttpServletResponse response = createTable(filter(SECRET, INTERNAL), token(new byte[0], "MANAGER"));
        assertEquals(401, response.getStatus());
    }

    @Test
    void acceptsAStaffTokenSignedWithTheSecret() throws Exception {
        MockHttpServletResponse response = createTable(
                filter(SECRET, INTERNAL), token(SECRET.getBytes(StandardCharsets.UTF_8), "MANAGER"));
        assertEquals(299, response.getStatus());
    }

    @Test
    void acceptsTheInternalTokenOnlyWhenItMatches() throws Exception {
        assertEquals(299, createTable(filter(SECRET, INTERNAL), INTERNAL).getStatus());
        assertEquals(401, createTable(filter(SECRET, INTERNAL), "test-internal-token-0123456780").getStatus());
    }
}
