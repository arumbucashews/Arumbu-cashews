/* Arumbu Cashews — Razorpay checkout (client side).
   The browser never decides that an order is paid. Flow:
     1. razorpay-create-order (edge function) creates the gateway order
        for the amount stored in the database;
     2. Razorpay Checkout collects the payment;
     3. razorpay-verify (edge function) checks the signature and the
        captured amount with Razorpay, then marks the order paid.
   Payment secrets live only in Supabase Edge Function secrets. */
(function () {
  'use strict';
  var S = window.ArumbuStore;
  if (!S) return;

  function loadCheckout() {
    if (window.Razorpay) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('gateway_script_failed')); };
      document.head.appendChild(s);
    });
  }

  function callFn(name, body) {
    return S.client.auth.getSession().then(function (res) {
      var token = res.data && res.data.session && res.data.session.access_token;
      if (!token) throw new Error('not_authenticated');
      return fetch(window.ARUMBU_FUNCTIONS_URL + '/' + name, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, apikey: window.ARUMBU_PUBLIC_SUPABASE_ANON_KEY },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) { var e = new Error(data.error || ('http_' + r.status)); e.status = r.status; throw e; }
          return data;
        });
      });
    });
  }

  // Resolves { paid: true } | { paid: false, reason }
  function pay(orderId) {
    return Promise.all([loadCheckout(), callFn('razorpay-create-order', { order_id: orderId })]).then(function (r) {
      var o = r[1];
      return new Promise(function (resolve) {
        var rz = new window.Razorpay({
          key: o.key_id,
          amount: o.amount,
          currency: o.currency,
          order_id: o.razorpay_order_id,
          name: 'Arumbu Cashews',
          description: 'Order ' + o.order_number,
          prefill: o.prefill || {},
          notes: o.notes || {},
          theme: { color: '#1B0E06' },
          handler: function (resp) {
            callFn('razorpay-verify', {
              order_id: orderId,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature
            }).then(function () { resolve({ paid: true }); }, function (err) { resolve({ paid: false, reason: err.message }); });
          },
          modal: { ondismiss: function () { resolve({ paid: false, reason: 'dismissed' }); } }
        });
        rz.on('payment.failed', function () { /* the modal lets the customer retry; dismiss resolves */ });
        rz.open();
      });
    });
  }

  window.ArumbuPay = { pay: pay, callFn: callFn };
})();
