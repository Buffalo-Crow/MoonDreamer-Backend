const UnauthorizedError = require("../utils/errorClasses/unauthorized");

const login = (req, res, next) => {
  return next(
    new UnauthorizedError("Login is handled by Firebase Auth. Use the client SDK.")
  );
};

module.exports = login;