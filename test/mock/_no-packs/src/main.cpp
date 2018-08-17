#include <iostream>
#include <xyz.h>
#include <one/one.h>

using namespace std;

int 
main() {
	cout << "!!!Hello World!!!" << endl; // prints !!!Hello World!!!

  int v;
  v = xyz_1c(1, 2);
  v += xyz_2cpp(3, 4);
  v += one(5, 6);

	return v;
}
