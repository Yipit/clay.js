all: init clean unit functional

export NODE_PATH:=$(NODE_PATH):$(PWD)/../
export MOCHA_BIN:=$(PWD)/node_modules/mocha/bin/mocha
export MOCHA_CMD:=$(MOCHA_BIN) -t 200 -b -u bdd -r should -r colors -R spec test/kind/test.*.js

init:
	@echo "installing mocha (if necessary)..."
	@test -e $$MOCHA_BIN || npm install -g mocha
	@echo "installing other dependencies..."
	@npm install

unit:
	@echo "Running unit tests ..."
	@`(echo $$MOCHA_CMD | sed "s,kind,unit,g")`

functional: init clean
	@echo "Running functional tests ..."
	@`(echo $$MOCHA_CMD | sed "s,kind,functional,g")`

clean:
	@printf "Cleaning up files that are already in .gitignore... "
	@for pattern in `cat .gitignore`; do find . -name "$$pattern" -delete; done
	@echo "OK!"

echo:
	echo $$MOCHA_CMD