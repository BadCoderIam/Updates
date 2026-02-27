export default function TrainingCatalog() {
  return (
    <>
      <div className="bgPattern" />
      <div className="heroBlur" />
      <main className="row">
        <div className="card" style={{ flex: "1 1 720px" }}>
          <h2 style={{ marginTop: 0 }}>Training (catalog)</h2>
          <p style={{ opacity: 0.9 }}>
            This page lists training areas LevelUp Pro offers. To launch training questions, use the <b>Start Now</b> button from the dashboard.
          </p>

          <hr style={{ margin: "14px 0" }} />

          <h3 style={{ marginTop: 0 }}>Current tracks</h3>
          <ul>
            <li><b>Help Desk</b>: tickets, troubleshooting basics, escalation</li>
            <li><b>Desktop Support</b>: Windows endpoint triage, device fixes</li>
            <li><b>Cloud Fundamentals</b>: intro concepts and terminology</li>
          </ul>

          <h3>Coming next</h3>
          <ul>
            <li>Azure / Microsoft 365 deeper modules</li>
            <li>AWS identity/networking quick labs</li>
            <li>Scenario-based “choose your path” training</li>
          </ul>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <a href="/dashboard"><button className="primary">Back to Dashboard</button></a>
            <a href="/start#how"><button>How it works</button></a>
          </div>
        </div>

        <div className="card" style={{ flex: "1 1 360px" }}>
          <h3 style={{ marginTop: 0 }}>How to access</h3>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>Go to <b>Dashboard</b></li>
            <li>Click <b>Start Now</b></li>
            <li>Select <b>Position training</b></li>
          </ol>
          <p style={{ marginTop: 10, opacity: 0.8 }}>
            <small>
              This keeps users from jumping straight into modules without the leveling flow.
            </small>
          </p>
        </div>
      </main>
    </>
  );
}
