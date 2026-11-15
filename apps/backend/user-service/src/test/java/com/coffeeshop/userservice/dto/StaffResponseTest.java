package com.coffeeshop.userservice.dto;

import com.coffeeshop.userservice.entity.User;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class StaffResponseTest {

    private User coworker() {
        User user = User.builder()
                .id("u1")
                .email("barista@shop.vn")
                .password("hash")
                .name("Barista A")
                .phone("0900000009")
                .role(User.Role.BARISTA)
                .branchId("branch-a")
                .employeeCode("BAR009")
                .personalQrCode("QR-BAR009")
                .hireDate(LocalDate.of(2026, 1, 5))
                .baseSalary(new BigDecimal("8000000"))
                .build();
        user.setSalaryType(User.SalaryType.values()[0]);
        return user;
    }

    @Test
    void coworkerViewHidesContactCodesAndPay() {
        StaffResponse view = StaffResponse.coworkerView(coworker(), "Chi nhanh A");

        assertEquals("Barista A", view.getName());
        assertEquals("BARISTA", view.getRole());
        assertEquals("Chi nhanh A", view.getBranchName());
        assertNull(view.getEmail());
        assertNull(view.getPhone());
        assertNull(view.getEmployeeCode());
        assertNull(view.getPersonalQrCode());
        assertNull(view.getHireDate());
        assertNull(view.getBaseSalary());
        assertNull(view.getSalaryType());
    }

    @Test
    void managerViewKeepsEverything() {
        StaffResponse view = StaffResponse.from(coworker(), "Chi nhanh A");

        assertEquals("barista@shop.vn", view.getEmail());
        assertEquals(new BigDecimal("8000000"), view.getBaseSalary());
        assertEquals(LocalDate.of(2026, 1, 5), view.getHireDate());
        assertEquals("QR-BAR009", view.getPersonalQrCode());
    }
}
