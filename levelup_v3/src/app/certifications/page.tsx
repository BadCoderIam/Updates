export default function CertificationsCatalog() {
  return (
    <>
      <div className="bgPattern" />
      <div className="heroBlur" />
      <main className="row">
        <div className="card" style={{ flex: "1 1 720px" }}>
          <h2 style={{ marginTop: 0 }}>Certifications (catalog)</h2>
          <p style={{ opacity: 0.9 }}>
            This page shows what LevelUp Pro supports right now. To start practice, use the <b>Start Now</b> button from the dashboard.
          </p>

          <hr style={{ margin: "14px 0" }} />

          <h3 style={{ marginTop: 0 }}>Included certification practice tracks</h3>
          <ul>
            <li><b>CompTIA A+</b> (practice)</li>
            <li><b>Security+</b> (practice)</li>
            <li><b>AZ-900</b> (practice)</li>
          </ul>

          <h3>Coming next</h3>
          <ul>
            <li>Timed exam mode + scoring</li>
            <li>Domain breakdown analytics</li>
            <li>More cloud cert tracks</li>
          </ul>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <a href="/dashboard"><button className="primary">Back to Dashboard</button></a>
            <a href="/start#pricing"><button>Pricing</button></a>
          </div>

          <p style={{ marginTop: 12, opacity: 0.75 }}>
            <small>
              Note: Certification names are trademarks of their respective owners. LevelUp Pro provides practice content only.
            </small>
          </p>
        </div>

        <div className="card" style={{ flex: "1 1 360px" }}>
          <h3 style={{ marginTop: 0 }}>How to access</h3>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>Go to <b>Dashboard</b></li>
            <li>Click <b>Start Now</b></li>
            <li>Select <b>Certifications</b></li>
          </ol>
          <p style={{ marginTop: 10, opacity: 0.8 }}>
            <small>
              This keeps the user journey consistent: Start Now → module window → earn XP.
            </small>
          </p>
        </div>
      </main>
    </>
  );
}
