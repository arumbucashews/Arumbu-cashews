/* Arumbu Cashews — wishlist page (guests: this device; signed-in
   customers are sent to their account wishlist). */
(function () {
  'use strict';
  var S = window.ArumbuStore, C = window.ArumbuCards;
  if (!S || !C) return;
  var grid = document.getElementById('wlGrid');
  function render() {
    S.loadCatalog().then(function (list) {
      var ids = S.wishlist.ids();
      var items = (list || []).filter(function (p) { return ids.indexOf(p.id) > -1; });
      document.getElementById('wlEmpty').hidden = items.length > 0;
      C.renderInto(grid, items);
    });
  }
  S.ready.then(function () {
    if (S.user()) { window.location.replace('account.html#wishlist'); return; }
    render();
  });
  document.addEventListener('arumbu:wishlist', render);
})();
