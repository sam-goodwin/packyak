#! /bin/bash

source .env
cd lib.jsii/python
python3 -m twine upload --verbose --skip-existing *