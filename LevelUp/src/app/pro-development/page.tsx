export default function ProDevelopmentPage() {
  return (
    <>
      <div className="bgPattern" />
      <div className="heroBlur" />
    <main className="row">
      <div className="card" style={{ flex: "1 1 720px" }}>
        <h2 style={{ marginTop: 0 }}>Professional Development</h2>
        <p><b>Prepare for your College Degree</b></p>
        <p>
          This module will help users map a degree plan to career outcomes (IT Support → Cloud → Security),
          with weekly study plans, milestones, and accountability.
        </p>

        <h3>Coming next</h3>
        <ul>
          <li>Choose degree path (IT, CS, Cybersecurity, Cloud)</li>
          <li>Semester-by-semester plan</li>
          <li>Study habits + time blocks</li>
          <li>Milestones and rewards</li>
        </ul>

        <a href="/"><button>Home</button></a>
        <a href="/dashboard"><button style={{ marginLeft: 10 }}>Dashboard</button></a>
      </div>
    </main>
    </>
  );
}
