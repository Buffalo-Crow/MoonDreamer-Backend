const jwt = require("jsonwebtoken");
const  UnauthorizedError  = require("../utils/errorClasses/unauthorized"); // your custom error class
const JWT_SECRET = process.env.JWT_SECRET;

const tokenAuthorization = (req, res, next) => {
  const { authorization } = req.headers;

  if (!authorization || !authorization.startsWith("Bearer")) {
    return next(new UnauthorizedError("Authorization header is required"));
  }

  const token = authorization.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new UnauthorizedError("Invalid token"));
    }
    return next(err);
  }
};

module.exports = tokenAuthorization;
