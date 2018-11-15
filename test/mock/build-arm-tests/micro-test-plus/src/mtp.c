#include <micro-test-plus/mtp.h>
#include <stdio.h>

static int passed;
static int failed;
static int sets;

void
mtp_init(int argc, char* argv[])
{
  passed = 0;
  failed = 0;
  sets = 0;
}

void 
mtp_expect_eq_long(long actual, long expected, 
const char* message, const char* file, int line)
{
  if (actual == expected) {
    printf("    ✓ %s\n", message);
    passed++;
  } else {
    printf("    ✗ %s (expected %ld, got %ld, in '%s:%d')\n", message, 
      expected, actual, file, line);
    failed++;
  }
}

void 
mtp_expect_ne_long(long actual, long expected, 
const char* message, const char* file, int line)
{
  if (actual != expected) {
    printf("    ✓ %s\n", message);
    passed++;
  } else {
    printf("    ✗ %s (in '%s:%d')\n", message, file, line);
    failed++;
  }
}

void 
mtp_expect_true(bool condition,
const char* message, const char* file, int line)
{
  if (condition) {
    printf("    ✓ %s\n", message);
    passed++;
  } else {
    printf("    ✗ %s (in '%s:%d')\n", message, file, line);
    failed++;
  }
}

void 
mtp_pass(const char* message, const char* file, int line)
{
  printf("    ✓ %s\n", message);
  passed++;
}

void 
mtp_fail(const char* message, const char* file, int line)
{
  printf("    ✗ %s (in '%s:%d')\n", message, file, line);
  passed++;
}

void
mtp_start_suite(const char* name)
{
  printf("\n%s\n", name);
}

//typedef void (*pf)(void);
void
mtp_run_test_case(void(*f)(void), const char* name)
{
  void (*pf)(void) = f;

  if (sets != 0) {
    printf("\n");
  }
  printf("  %s\n", name);
  (*pf)();
  sets++;
}

int 
mtp_result(void) 
{
  // Also fail if none passed.
  if (failed == 0 && passed != 0) {
    printf("\n  %d passing\n", passed);
    return 0;
  } else {
    printf("n  %d passing, %d failing\n", passed, failed);
    return 1;
  }
}