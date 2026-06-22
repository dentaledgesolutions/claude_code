# Skill Builder — common task shortcuts
# Usage: make <target> [SKILL=skill-name]

SKILL ?= skill-scout

.PHONY: context evals audit validate install-to help

## Regenerate evals/project-context.json
context:
	node skills/skill-eval/scripts/extract-project-context.js

## Generate 9 eval scenarios for a skill (default: skill-scout)
## Usage: make evals SKILL=skill-adapt
evals:
	node skills/skill-eval/scripts/generate-seed-evals.js skills/$(SKILL)/SKILL.md \
		--context evals/project-context.json

## Run static security scan on a skill directory (default: skill-scout)
## Usage: make audit SKILL=skill-audit
audit:
	node skills/skill-audit/scripts/static-scan.js skills/$(SKILL)/

## Validate frontmatter on all SKILL.md files
validate:
	node scripts/validate-skills.js

## Dry-run install to a target project
## Usage: make install-to TARGET=/path/to/project
install-to:
	./install.sh --dry-run $(TARGET)

help:
	@echo "Targets:"
	@echo "  make context              Regenerate evals/project-context.json"
	@echo "  make evals [SKILL=name]   Generate 9 eval scenarios (default: skill-scout)"
	@echo "  make audit [SKILL=name]   Run static scanner on a skill directory"
	@echo "  make validate             Validate all SKILL.md frontmatter"
	@echo "  make install-to TARGET=… Dry-run install to a project path"
