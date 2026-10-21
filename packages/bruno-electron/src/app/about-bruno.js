module.exports = function aboutBruno({ version }) {
  const currentYear = new Date().getFullYear();
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, minimum-scale=1.0, initial-scale=1, user-scalable=yes">
        <title>About Hanuman</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                text-align: center;
                margin: 0;
                padding: 10px;
                background-color: #f4f4f4;
                color: #333;
            }
            .logo {
                margin-top: 0px;
            }
            .title {
                font-size: 24px;
                margin-top: 5px;
                font-weight: bold;
                color: #222;
            }
            .description {
                font-size: 12px;
                color: #222;
                margin-top: 5px;
            }
            .buttons {
                margin-top: 5px;
            }
            .footer {
                margin-top: 5px;
                padding: 5px;
                font-size: 14px;
                color: #555;
            }
            .link {
                display: inline-block;
                margin-top: 10px;
                padding: 10px 15px;
                background-color: #EA580C;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                cursor: pointer;
                transition: background 0.3s;
            }
            .link:hover {
                background-color: #C2410C;
            }
        </style>
    </head>
    <body>
      <div class="logo">
      </div>
        <svg width="100" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="37" r="8" fill="#EA580C"/>
          <circle cx="53" cy="37" r="8" fill="#EA580C"/>
          <circle cx="11" cy="37" r="4" fill="#FDBA74"/>
          <circle cx="53" cy="37" r="4" fill="#FDBA74"/>
          <circle cx="32" cy="39" r="19" fill="#EA580C"/>
          <path d="M32 31.5c-2.2-3.4-5.4-4.6-8.2-4.1-4.2.8-6.4 4.9-5.4 9.3.5 2.1 1.6 3.6 2.6 4.8-.9 1.6-1.3 3.4-1.1 5.3.7 6.2 6 9.7 12.1 9.7s11.4-3.5 12.1-9.7c.2-1.9-.2-3.7-1.1-5.3 1-1.2 2.1-2.7 2.6-4.8 1-4.4-1.2-8.5-5.4-9.3-2.8-.5-6 .7-8.2 4.1z" fill="#FFF1E0"/>
          <ellipse cx="25.5" cy="36" rx="2.4" ry="3" fill="#1C1917"/>
          <ellipse cx="38.5" cy="36" rx="2.4" ry="3" fill="#1C1917"/>
          <circle cx="30" cy="45" r="1.1" fill="#9A3412"/>
          <circle cx="34" cy="45" r="1.1" fill="#9A3412"/>
          <path d="M27.5 49.5q4.5 3.6 9 0" fill="none" stroke="#9A3412" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M32 24.5c1.3 1.6 1.6 3.4 0 5.6-1.6-2.2-1.3-4 0-5.6z" fill="#DC2626"/>
          <path d="M21 21.5L25.5 15h2.2L30 8.5 32 2l2 6.5 2.3 6.5h2.2l4.5 6.5z" fill="#FBBF24" stroke="#B45309" stroke-width="1.2" stroke-linejoin="round"/>
          <rect x="19.5" y="19.5" width="25" height="4.5" rx="2.25" fill="#FBBF24" stroke="#B45309" stroke-width="1.2"/>
          <circle cx="32" cy="21.75" r="1.6" fill="#DC2626"/>
        </svg>
      <h2 class="title">Hanuman ${version}</h2>
      <footer class="footer">
          Based on Bruno (MIT license) · ©${currentYear} Bruno Software Inc
      </footer>
    </body>
    </html>
  `;
};
