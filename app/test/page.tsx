export default function TestPage() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      color: 'white',
      padding: '20px'
    }}>
      <h1 style={{
        fontSize: '72px',
        margin: '0',
        textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
      }}>
        🎨 TEST SEITE
      </h1>
      <p style={{
        fontSize: '32px',
        marginTop: '20px',
        textAlign: 'center'
      }}>
        Wenn Sie diese Seite mit einem<br />
        <strong>LILA-BLAUEN GRADIENT</strong> sehen,<br />
        funktioniert Next.js!
      </p>
      <div style={{
        marginTop: '40px',
        padding: '20px 40px',
        background: '#ff6b00',
        borderRadius: '10px',
        fontSize: '24px',
        fontWeight: 'bold',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
      }}>
        🔥 ORANGE BUTTON
      </div>
      <p style={{
        marginTop: '40px',
        fontSize: '18px',
        opacity: 0.9
      }}>
        Zeit: {new Date().toLocaleTimeString('de-DE')}
      </p>
    </div>
  );
}
