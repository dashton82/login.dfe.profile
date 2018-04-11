const Account = require('./../../infrastructure/account');

const validateInput = (req) => {
  const model = {
    givenName: req.body.givenName,
    familyName: req.body.familyName,
    validationMessages: {},
  };

  if (!model.givenName || model.givenName.trim().length === 0) {
    model.validationMessages.givenName = 'Please enter your first name';
  }

  if (!model.familyName || model.familyName.trim().length === 0) {
    model.validationMessages.familyName = 'Please enter your last name';
  }

  return model;
};

const action = async (req, res) => {
  const model = validateInput(req);
  if (Object.keys(model.validationMessages).length > 0) {
    model.csrfToken = req.csrfToken();
    return res.render('editDetails/views/edit', model);
  }

  const account = Account.fromContext(req.user);
  account.givenName = model.givenName;
  account.familyName = model.familyName;
  await account.update(req.id);

  res.flash('info', 'You details have been updated');
  return res.redirect('/');
};

module.exports = action;