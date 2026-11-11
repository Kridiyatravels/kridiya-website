"use strict";
(function () {
  const routes = {"/about.html":"/about/","/account.html":"/account/","/admin.html":"/admin/","/contact.html":"/contact/","/corporate-account.html":"/corporate-account/","/corporate-booking.html":"/corporate-booking/","/corporate-invitation.html":"/corporate-invitation/","/cruise.html":"/cruise/","/flights.html":"/flights/","/forgot-password.html":"/forgot-password/","/guides/flight-booking-checklist.html":"/guides/flight-booking-checklist/","/guides/index.html":"/guides/","/holidays.html":"/holidays/","/hotels.html":"/hotels/","/index.html":"/","/login.html":"/login/","/privacy.html":"/privacy/","/register.html":"/register/","/reset-password.html":"/reset-password/","/sitemap.html":"/sitemap/","/terms.html":"/terms/","/thanks.html":"/thanks/","/track-enquiry.html":"/track-enquiry/","/umrah.html":"/umrah/","/unsubscribe.html":"/unsubscribe/","/visa.html":"/visa/"};
  const reverse = Object.fromEntries(Object.entries(routes).map(([oldPath,path]) => [path,oldPath]));
  function path(value) { return routes[value] || (reverse[value] ? value : reverse[value + "/"] ? value + "/" : value); }
  window.KridiyaRoutes = Object.freeze({path, legacy: value => reverse[value] || value});
  const canonical = path(location.pathname);
  if (canonical !== location.pathname) history.replaceState(history.state, "", canonical + location.search + location.hash);
})();
