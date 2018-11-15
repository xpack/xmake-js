#ifndef MICRO_TEST_H_
#define MICRO_TEST_H_

#include <stdbool.h>

#if defined(__cplusplus)
extern "C"
{
#endif

void
mtp_init(int argc, char* argv[]);

void 
mtp_expect_eq_long(long actual, long expected, 
  const char* message, const char* file, int line);

void 
mtp_expect_ne_long(long actual, long expected, 
  const char* message, const char* file, int line);

void 
mtp_expect_true(bool condition, const char* message, 
  const char* file, int line);

void 
mtp_pass(const char* message, const char* file, int line);

void 
mtp_fail(const char* message, const char* file, int line);

void
mtp_run_test_case(void(*f)(void), const char* name);

void
mtp_start_suite(const char* name);

int 
mtp_result(void);

// TODO: use blocks and local variables, to avoid multiple evaluations.
#define MTP_EXPECT_EQ(actual, expected, message) mtp_expect_eq_long(actual, expected, message, __FILE__, __LINE__)
#define MTP_EXPECT_NE(actual, expected, message) mtp_expect_ne_long (actual, expected, message, __FILE__, __LINE__)
#define MTP_EXPECT_TRUE(condition, message) mtp_expect_true(condition, message, __FILE__, __LINE__)

#define MTP_PASS(message) mtp_pass(message, __FILE__, __LINE__)
#define MTP_FAIL(message) mtp_fail(message, __FILE__, __LINE__)

#if defined(__cplusplus)
}
#endif

#endif // MICRO_TEST_H_
