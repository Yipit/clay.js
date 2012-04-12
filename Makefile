all: init unit functional

export MOCHA_CMD:=mocha -t 20000 -b -u bdd -r should -r colors -R spec test/kind/test.*.js

init:
	@echo "installing dependencies..."
	@npm install

unit:
	@echo "Running unit tests ..."
	@`(echo $$MOCHA_CMD | sed "s,kind,unit,g")`

functional: init
	@echo "Running functional tests ..."
	@`(echo $$MOCHA_CMD | sed "s,kind,functional,g")`

echo:
	echo $$MOCHA_CMD
