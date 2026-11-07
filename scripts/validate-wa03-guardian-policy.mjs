import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('guardian-policies/WA03.001');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'policy.json'), 'utf8'));
const schemaDir = path.join(root, 'schemas');
const schemas = new Map(fs.readdirSync(schemaDir).filter(name => name.endsWith('.json')).map(name => {
  const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, name), 'utf8'));
  return [schema.iri, schema];
}));
const blocks = [];
function visit(block) {
  blocks.push(block);
  for (const child of block.children || []) visit(child);
}
visit(policy.config);
const byTag = new Map(blocks.map(block => [block.tag, block]));
const baseline = schemas.get('#8b2d9c31-5c1b-4a7f-9b5a-000000000002');
const monitoring = schemas.get('#8b2d9c31-5c1b-4a7f-9b5a-000000000003');
const validator = byTag.get('wa03_baseline_reconciliation_validator');
const monitoringForm = byTag.get('wa03_monitoring_form');
const calculator = byTag.get('wa03_equation4_calc');

assert.equal(schemas.size, 5, 'exactly five methodology schemas must be bundled');
assert.ok(baseline && monitoring, 'baseline and monitoring schemas must be bundled');
for (const name of ['activityId', 'baselineRecordId', 'baselineRecordSha256', 'fch4BL']) {
  assert.ok(baseline.document.required.includes(name), `baseline schema must require ${name}`);
  assert.ok(monitoring.document.required.includes(name), `monitoring schema must require ${name}`);
}
assert.ok(validator, 'baseline reconciliation validator must exist');
assert.equal(validator.blockType, 'documentValidatorBlock');
assert.equal(validator.options.documentType, 'vc-document');
assert.equal(validator.options.schema, monitoring.iri);
assert.equal(validator.options.sourceValidations.length, 1);
const source = validator.options.sourceValidations[0];
assert.equal(source.dbCollection, 'VcDocument');
assert.equal(source.schema, baseline.iri);
assert.equal(source.allowEmptySource, false, 'missing baseline must fail closed');
for (const field of ['activityId', 'baselineRecordId']) {
  assert.ok(source.filters.some(filter => filter.field.endsWith(field) && filter.typeValue === 'variable'), `source must be filtered by incoming ${field}`);
}
for (const field of ['fch4BL', 'baselineRecordSha256']) {
  assert.ok(source.conditions.some(condition => condition.fieldSource === 'source' && condition.field.endsWith(field) && condition.valueSource === 'document' && condition.value.endsWith(field)), `source and incoming ${field} must match`);
}
assert.ok(monitoringForm.events.some(event => event.target === validator.tag && event.output === 'RunEvent' && event.input === 'RunEvent'), 'monitoring submission must invoke baseline validation');
assert.ok(validator.events.some(event => event.target === calculator.tag && event.output === 'RunEvent' && event.input === 'RunEvent'), 'calculation must follow successful baseline validation');
assert.ok(policy.policyNavigation.some(nav => nav.steps.some(step => step.block === validator.tag)), 'validator must be reachable in navigation');
const math = blocks.find(block => block.tag === 'wa03_equation4_math');
assert.ok(math.equations.some(equation => equation.variable === 'E_GWP' && equation.formula === '29.8'));
assert.ok(math.equations.some(equation => equation.variable === 'E_ER' && equation.formula === '(E_FCH4_PJ-E_FCH4_BL)*E_GWP*(1-E_OX)-E_PE-E_LE'));
assert.deepEqual(policy.tools, [], 'do not fabricate native Guardian tool IDs for BEE methodology tool requirements');
console.log('WA03.001 Guardian policy structural validation passed: 5 schemas; baseline cross-form consistency gate; fail-closed source; monitoring -> validator -> Equation 4; navigation and official equation checked.');
console.log('Limitation: this is structural validation, not Guardian runtime validation or proof of trusted RupayKg baseline approval.');
