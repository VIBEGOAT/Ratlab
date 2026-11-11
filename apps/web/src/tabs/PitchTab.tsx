import { REFERENCES } from "@eliminate/sim-core";
import { Chip, Panel, TabHead, ScrollBox } from "../components/ui";

export default function PitchTab() {
  return (
    <>
      <TabHead title="Sources" blurb="The references used for model structure, study design, dose scaling, and credibility framing." />
      <Panel title="References">
        <p className="small muted">VERIFIED means the bibliographic record was confirmed against a live source. It does not mean every number taken from the paper was checked.</p>
        <ScrollBox><table>
          <thead><tr><th>Status</th><th>Reference</th><th>Used for</th></tr></thead>
          <tbody>{REFERENCES.map((x) => (
            <tr key={x.id}>
              <td><Chip kind={x.status}>{x.status}</Chip></td>
              <td>{x.authors} ({x.year ?? "n.d."}). {x.title}. <span className="muted">{x.venue}</span>{x.doi ? <> · <a href={`https://doi.org/${x.doi}`} target="_blank" rel="noreferrer">doi:{x.doi}</a></> : x.url ? <> · <a href={x.url} target="_blank" rel="noreferrer">link</a></> : null}{x.note ? <div className="small muted">{x.note}</div> : null}</td>
              <td className="small">{x.usedFor}</td>
            </tr>))}</tbody>
        </table></ScrollBox>
      </Panel>
    </>
  );
}
