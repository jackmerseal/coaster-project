const validBody = (schema) => {
  return (req, res, next) => {
      const validationResult = schema.validate(req.body, {abortEarly: false});
      if (validationResult.error) {
        return res.status(400).json({error: validationResult.error.details.map((err) => err.message),});
      } else{
          req.body = validationResult.value;
          next();
      }
    };
  };

export {validBody};