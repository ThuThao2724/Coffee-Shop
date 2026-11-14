package com.coffeeshop.userservice.config;

import com.coffeeshop.userservice.entity.User;
import com.coffeeshop.userservice.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates the first ADMIN account on a fresh install, from BOOTSTRAP_ADMIN_EMAIL and
 * BOOTSTRAP_ADMIN_PASSWORD. Does nothing once any ADMIN exists, and never modifies an existing
 * account, so the variables can be removed from the environment after the first start.
 * Runs once the application is ready, i.e. after schema migrations and any demo seeding.
 */
@Slf4j
@Component
public class AdminBootstrap {

    static final int MIN_PASSWORD_LENGTH = 12;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;

    public AdminBootstrap(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.bootstrap-admin.email:}") String email,
            @Value("${app.bootstrap-admin.password:}") String password
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.email = email == null ? "" : email.trim();
        this.password = password == null ? "" : password;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void bootstrap() {
        if (userRepository.existsByRole(User.Role.ADMIN)) {
            return;
        }
        if (email.isEmpty() || password.isEmpty()) {
            log.warn("No ADMIN account exists. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD "
                    + "and restart user-service to create the first one.");
            return;
        }
        if (password.length() < MIN_PASSWORD_LENGTH) {
            log.error("BOOTSTRAP_ADMIN_PASSWORD must be at least {} characters; no ADMIN account was created.",
                    MIN_PASSWORD_LENGTH);
            return;
        }
        if (userRepository.existsByEmail(email)) {
            log.error("BOOTSTRAP_ADMIN_EMAIL belongs to an existing non-admin account; "
                    + "no ADMIN account was created. Use another email.");
            return;
        }

        userRepository.save(User.builder()
                .email(email)
                .password(passwordEncoder.encode(password))
                .name("Administrator")
                .role(User.Role.ADMIN)
                .isActive(true)
                .build());
        log.info("Created the first ADMIN account ({}). BOOTSTRAP_ADMIN_PASSWORD can now be removed.", email);
    }
}
