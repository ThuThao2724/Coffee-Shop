package com.coffeeshop.userservice.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * With open-in-view on, each long-lived SSE subscription (/branches/{id}/hr/events) keeps a
 * database connection until the stream ends, which it never does: a few reconnects exhaust the
 * pool and logins hang. Keep it off.
 */
class OpenInViewDisabledTest {

    @Test
    void openInViewIsDisabled() throws IOException {
        Properties properties = new Properties();
        try (InputStream in = getClass().getClassLoader().getResourceAsStream("application.properties")) {
            assertThat(in).isNotNull();
            properties.load(in);
        }
        assertThat(properties.getProperty("spring.jpa.open-in-view")).isEqualTo("false");
    }
}
