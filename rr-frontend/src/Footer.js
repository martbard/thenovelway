// src/Footer.js
export default function Footer() {
  return (
    <footer className="footer" style={{ padding: '1.25rem 0', marginTop: '2rem' }}>
      <div className="container" style={{ textAlign: 'center' }}>
        <p>&copy; {new Date().getFullYear()} The Novel Way. All rights reserved.</p>
        <p className="muted" style={{ marginTop: '.25rem' }}>
          <a href="/about">About</a> · <a href="/privacy">Privacy</a> · <a href="/contact">Contact</a>
        </p>
      </div>
    </footer>
  );
}
