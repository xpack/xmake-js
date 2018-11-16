#include <micro-test-plus/mtp.h>
#include <stdio.h>

static int passed;
static int failed;
static int sets;

void
mtp_init(int argc __attribute__((unused)), 
         char* argv[] __attribute__((unused)))
{
  passed = 0;
  failed = 0;
  sets = 0;
#if defined(__clang__)
  printf ("Built with clang " __VERSION__);
#else
  printf ("Built with GCC " __VERSION__);
#endif
#if defined(__EXCEPTIONS)
  printf (", with exceptions");
#else
  printf (", no exceptions");
#endif
#if defined(DEBUG)
  printf (", with DEBUG");
#endif
  puts (".");

#if defined(DEBUG)
  printf("argv[] = ");
  for (int i = 0; i < argc; ++i) {
    printf("'%s' ", argv[i]);
  }
  puts("");
#endif
}

void 
mtp_expect_eq_long(long actual, 
                   long expected, 
                   const char* message, 
                   const char* file, int line)
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
mtp_expect_ne_long(long actual, 
                   long expected, 
                   const char* message, 
                   const char* file, 
                   int line)
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
                const char* message, 
                const char* file, 
                int line)
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
mtp_pass(const char* message, 
         const char* file __attribute__((unused)), 
         int line __attribute__((unused)))
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
    printf("\n  %d passing, %d failing\n", passed, failed);
    return 1;
  }
}