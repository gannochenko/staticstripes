.PHONY: install dev build start lint lint-fix format format-check clean

install:
	npm install

run:
	npm run dev

build:
	npm run build

start:
	npm start

lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

format-check:
	npm run format:check

clean:
	rm -rf node_modules dist *.tsbuildinfo
	rm -f package-lock.json

all: install build
