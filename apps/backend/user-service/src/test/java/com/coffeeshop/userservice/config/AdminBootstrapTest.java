package com.coffeeshop.userservice.config;

import com.coffeeshop.userservice.entity.User;
import com.coffeeshop.userservice.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminBootstrapTest {

    private static final String STRONG = "a-strong-pass-123";

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        when(passwordEncoder.encode(any())).thenAnswer(i -> "hashed:" + i.getArgument(0));
    }

    private AdminBootstrap bootstrap(String email, String password) {
        return new AdminBootstrap(userRepository, passwordEncoder, email, password);
    }

    @Test
    void createsFirstAdmin_whenNoAdminExists() {
        when(userRepository.existsByRole(User.Role.ADMIN)).thenReturn(false);
        when(userRepository.existsByEmail("owner@shop.vn")).thenReturn(false);

        bootstrap("  owner@shop.vn ", STRONG).bootstrap();

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertEquals("owner@shop.vn", saved.getValue().getEmail());
        assertEquals(User.Role.ADMIN, saved.getValue().getRole());
        assertEquals("hashed:" + STRONG, saved.getValue().getPassword());
        assertTrue(saved.getValue().getIsActive());
    }

    @Test
    void doesNothing_whenAnAdminAlreadyExists() {
        when(userRepository.existsByRole(User.Role.ADMIN)).thenReturn(true);

        bootstrap("owner@shop.vn", STRONG).bootstrap();

        verify(userRepository, never()).save(any());
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void doesNothing_whenVariablesAreMissing() {
        when(userRepository.existsByRole(User.Role.ADMIN)).thenReturn(false);

        bootstrap("", STRONG).bootstrap();
        bootstrap("owner@shop.vn", "").bootstrap();
        bootstrap(null, null).bootstrap();

        verify(userRepository, never()).save(any());
    }

    @Test
    void refusesShortPassword() {
        when(userRepository.existsByRole(User.Role.ADMIN)).thenReturn(false);

        bootstrap("owner@shop.vn", "x".repeat(AdminBootstrap.MIN_PASSWORD_LENGTH - 1)).bootstrap();

        verify(userRepository, never()).save(any());
    }

    @Test
    void neverTakesOverAnExistingAccount() {
        when(userRepository.existsByRole(User.Role.ADMIN)).thenReturn(false);
        when(userRepository.existsByEmail("customer@shop.vn")).thenReturn(true);

        bootstrap("customer@shop.vn", STRONG).bootstrap();

        verify(userRepository, never()).save(any());
    }
}
