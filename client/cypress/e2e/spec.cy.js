describe('User Journey Check', () => {
  it('Loads the app and checks navigation', () => {
    // 1. افتح الموقع (تأكد إن السيرفر شغال)
    cy.visit('http://localhost:5173'); // أو البورت بتاعك

    // 2. المفروض لو مش مسجل يحولك لصفحة اللوجن
    // (Clerk بياخد وقت شوية فبنديله وقت)
    cy.url({ timeout: 10000 }).should('include', '/login');

    // بما إن Clerk صعب نخليه يسجل دخول أوتوماتيك في Cypress النسخة المجانية بسهولة
    // إحنا هنكتفي بإننا نتأكد إن صفحة اللوجن ظهرت سليمة ومضربتش Error
    cy.contains('Sign in').should('be.visible');

    // لو عايز تتأكد إن فيه زرار معين موجود
    // cy.get('button').contains('Continue').should('exist');
  });
});