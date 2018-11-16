#include <micro-test-plus/mtp.h>
#include <xyz/xyz.h>

// Test suite for the xyz library.

static void test_case_xyz_add(void)
{
  MTP_EXPECT_EQ(xyz_add(1,2), 3, "1+2 is 3");
  MTP_EXPECT_EQ(xyz_add(2,1), 3, "2+1 is 3");
}

static void test_case_xyz_mul(void)
{
  MTP_EXPECT_EQ(xyz_mul(2,3), 6, "2*3 is 6");
  // MTP_EXPECT_EQ(xyz_mul(3,2), 6, "3*2 is 6");
  MTP_EXPECT_EQ(xyz_mul(3,2), 7, "3*2 is 7");
}

extern "C" int
main(int argc, char* argv[]);

int
main(int argc, char* argv[])
{
  mtp_init(argc, argv);

  mtp_start_suite("test/fail/xyz-suite.cpp");

  mtp_run_test_case(test_case_xyz_add, "add");
  mtp_run_test_case(test_case_xyz_mul, "mul");

  return mtp_result();
}