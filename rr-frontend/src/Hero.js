// src/Hero.js
export default function Hero() {
  return (
    <section className="surface" style={{ marginTop: '1rem', padding: '2rem' }} aria-label="Welcome">
      <div className="container" style={{ textAlign: 'center' }}>
        <h1>The Novel Way</h1>
        <p className="muted" style={{ marginTop: '.35rem' }}>
          Read, write, share.
        </p>
      </div>
    </section>
  );
}
