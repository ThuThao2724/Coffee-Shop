package com.coffeeshop.tableservice.repository;

import com.coffeeshop.tableservice.entity.CoffeeTable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TableRepository extends JpaRepository<CoffeeTable, String> {
    List<CoffeeTable> findByBranchId(String branchId);
    // Table numbers are unique per branch: every branch can have its own "Bàn 1".
    boolean existsByBranchIdAndNumber(String branchId, Integer number);
    boolean existsByBranchIdAndNumberAndIdNot(String branchId, Integer number, String id);
}
