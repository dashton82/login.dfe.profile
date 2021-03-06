const { getInvitationById, convertInvitationToUser } = require('./../../infrastructure/invitations');
const { migrateInvitation } = require('./../../infrastructure/services');
const { migrateInvitationServicesToUserServices } = require('./../../infrastructure/access');
const Account = require('./../../infrastructure/account');
const { createIndex, deleteFromIndex } = require('./../../infrastructure/search');
const logger = require('./../../infrastructure/logger');

const validateInput = (req) => {
  const model = {
    newPassword: req.body.newPassword,
    confirmPassword: req.body.confirmPassword,
    validationMessages: {},
    hideNav: true,
    title: 'Create password - DfE Sign-in',
  };

  if (!model.newPassword || model.newPassword.trim().length === 0) {
    model.validationMessages.newPassword = 'Enter a password';
  } else if (model.newPassword.length < 12) {
    model.validationMessages.newPassword = 'Password must be at least 12 characters';
  }

  if (!model.confirmPassword || model.confirmPassword.trim().length === 0) {
    model.validationMessages.confirmPassword = 'Re-type password';
  } else if (model.confirmPassword.length < 12) {
    model.validationMessages.confirmPassword = 'Password must be at least 12 characters';
  } else if (model.newPassword && model.newPassword !== model.confirmPassword) {
    model.validationMessages.confirmPassword = 'Passwords do not match';
  }

  return model;
};

const completeRegistration = async (invitationId, password) => {
  const invitation = await getInvitationById(invitationId);

  const claims = await convertInvitationToUser(invitationId, password);
  const user = new Account(claims);

  await migrateInvitation(invitationId, user.id);
  await migrateInvitationServicesToUserServices(invitationId, user.id);

  if (invitation.device) {
    await user.assignDevice(invitation.device.type, invitation.device.serialNumber);
  } else if (invitation.oldCredentials && invitation.oldCredentials.tokenSerialNumber) {
    await user.assignDevice('digipass', invitation.oldCredentials.tokenSerialNumber);
  } else if (invitation.tokenSerialNumber) {
    await user.assignDevice('digipass', invitation.tokenSerialNumber);
  }

  return user.id;
};

const postNewPassword = async (req, res) => {
  if (!req.session.registration || !req.session.registration.codeVerified) {
    return res.redirect(`/register/${req.params.id}`);
  }

  const model = validateInput(req);
  if (Object.keys(model.validationMessages).length > 0) {
    model.csrfToken = req.csrfToken();
    return res.render('register/views/newPassword', model);
  }

  const userId = await completeRegistration(req.params.id, model.newPassword);

  await deleteFromIndex(`inv-${req.params.id}`, req.id);
  await createIndex(userId, req.id);

  logger.audit(`Invitation ${req.params.id} accepted user created ${userId})`, {
    type: 'invitation-accepted',
    invitationId: req.params.id,
    userId,
  });

  req.session.registration.userId = userId;
  return res.redirect(`/register/${req.params.id}/complete`);
};

module.exports = postNewPassword;
