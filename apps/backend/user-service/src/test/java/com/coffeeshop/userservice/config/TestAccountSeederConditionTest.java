package com.coffeeshop.userservice.config;

import com.coffeeshop.userservice.repository.BranchRepository;
import com.coffeeshop.userservice.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** The demo accounts have published passwords: the seeder must stay off unless explicitly enabled. */
class TestAccountSeederConditionTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean("schemaMigrationRunner", Object.class, Object::new)
            .withBean(UserRepository.class, TestAccountSeederConditionTest::userRepository)
            .withBean(BranchRepository.class, TestAccountSeederConditionTest::branchRepository)
            .withBean(PasswordEncoder.class, () -> mock(PasswordEncoder.class))
            .withUserConfiguration(TestAccountSeeder.class);

    // save() echoes its argument so seed() can run end to end when the seeder is enabled.
    private static UserRepository userRepository() {
        UserRepository repository = mock(UserRepository.class);
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        return repository;
    }

    private static BranchRepository branchRepository() {
        BranchRepository repository = mock(BranchRepository.class);
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        return repository;
    }

    @Test
    void seederIsOff_byDefault() {
        runner.run(context -> assertThat(context).doesNotHaveBean(TestAccountSeeder.class));
    }

    @Test
    void seederIsOff_whenExplicitlyFalse() {
        runner.withPropertyValues("app.seed.test-accounts=false")
                .run(context -> assertThat(context).doesNotHaveBean(TestAccountSeeder.class));
    }

    @Test
    void seederIsOn_onlyWhenEnabled() {
        runner.withPropertyValues("app.seed.test-accounts=true")
                .run(context -> assertThat(context).hasSingleBean(TestAccountSeeder.class));
    }
}
