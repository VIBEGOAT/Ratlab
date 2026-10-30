import type { AnimalBundle, Organ } from '@eliminate/sim-core';
import { GRADE_WORD } from '../design/damage';
import { ratVisualState } from '../three/ratState';
import { ORGAN_LABEL } from '../lib/setup';

export function twinReadings(treated: AnimalBundle, untreated: AnimalBundle, day: number) {
  const index = Math.min(day, treated.days, untreated.days);
  const read = (bundle: AnimalBundle) => ({
    heart: bundle.clinpath[index]!.cardiac.heartRateBpm,
    alt: bundle.clinpath[index]!.chemistry.alt?.xUln ?? 0,
    tumor: bundle.daily.tumorVolume[index] ?? 0,
    visual: ratVisualState(bundle, index),
  });
  const control = read(untreated), dosed = read(treated);
  return { control, dosed, heartDelta: control.heart > 0 ? (dosed.heart / control.heart - 1) * 100 : null,
    tumorDelta: control.tumor > 0 ? (dosed.tumor / control.tumor - 1) * 100 : null };
}

/** Readouts are computed from the paired animals, never staged healthy/toxic example values. */
export function TwinTelemetry({ treated, untreated, day, target, split }: { treated: AnimalBundle; untreated: AnimalBundle; day: number; target: Organ; split: number }) {
  const data = twinReadings(treated, untreated, day);
  const delta = (value: number | null) => value === null ? '' : `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`;
  return <div className="twin-telemetry" style={{ gridTemplateColumns: `${split}fr ${1-split}fr` }}>
    {([['Untreated', data.control], ['Dosed', data.dosed]] as const).map(([label, values], index) => <div key={label} className={`twin-readout ${index ? 'dosed' : 'control'}`}>
      <span className="eyebrow">{label} / day {day}</span>
      <strong>{index ? 'A visible response.' : 'The same starting animal.'}</strong>
      <dl>
        <div><dt>Heart rate</dt><dd>{Math.round(values.heart)} <small>BPM</small>{!!index && <em>{delta(data.heartDelta)}</em>}</dd></div>
        <div><dt>ALT</dt><dd>{values.alt.toFixed(1)}× <small>upper limit</small></dd></div>
        <div><dt>{values.tumor > 0 ? 'Tumour volume' : ORGAN_LABEL[target]}</dt><dd>{values.tumor > 0 ? <>{values.tumor.toFixed(0)} <small>mm³</small>{!!index && <em>{delta(data.tumorDelta)}</em>}</> : GRADE_WORD[values.visual.organs[target].grade]}</dd></div>
      </dl>
      <span className="twin-material-key">{index ? 'Cutaway · compound target highlighted' : 'Exterior · disease state retained'}</span>
    </div>)}
    <p className="twin-data-note">Paired simulation outputs. Respiration and postural motion are illustrative; untreated does not necessarily mean healthy.</p>
  </div>;
}
