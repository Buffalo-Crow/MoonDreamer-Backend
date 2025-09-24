const INTERNAL_SERVER_ERROR = 500;

function errorHandler(err, req, res, next) {
  console.error(err);

  const { statusCode = INTERNAL_SERVER_ERROR, message } = err;
  res.status(statusCode).send({
    message:
      statusCode === INTERNAL_SERVER_ERROR
        ? "An error has occurred on the server"
        : message,
  });
}
module.exports = errorHandler;