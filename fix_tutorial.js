const fs = require('fs');
let tutorialJs = fs.readFileSync('eva-pc/web/js/ui/tutorial.js', 'utf8');

const functionAppPC = `
window.showTutorialAppPC = function() {
  if (window.Driver) {
    const driverObj = window.Driver.driver({
      showProgress: true,
      animate: true,
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'Terminer',
      steps: [
        {
          popover: {
            title: 'E.V.A Desktop',
            description: 'Bienvenue sur la version Agent PC. Cette version native s\\'intègre profondément à votre système.'
          }
        },
        {
          popover: {
            title: 'La Fenêtre Flottante',
            description: 'Dites simplement "E.V.A" à tout moment, et la fenêtre flottante transparente apparaîtra par-dessus vos autres fenêtres pour vous écouter, sans interrompre votre travail !'
          }
        },
        {
          element: '#nav-settings',
          popover: {
            title: 'CloudWorks OS Agent',
            description: 'Dans les paramètres CloudWorks, vous verrez que votre PC est configuré comme un Agent local. Il peut exécuter des scripts de fond envoyés depuis votre téléphone !'
          }
        },
        {
          popover: {
            title: 'Mises à jour automatiques',
            description: 'Vous êtes notifié dès qu\\'une mise à jour est disponible au lancement. E.V.A se met à jour toute seule.'
          }
        }
      ]
    });
    driverObj.drive();
  }
};
`;

tutorialJs += functionAppPC;

fs.writeFileSync('eva-pc/web/js/ui/tutorial.js', tutorialJs, 'utf8');
console.log("TUTORIAL APP PC ADDED");
