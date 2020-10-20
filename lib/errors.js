class DeckError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class AppNotFound extends DeckError {}

class ExistingSecretWontDelete extends DeckError {}

module.exports = {
  AppNotFound,
  ExistingSecretWontDelete,
};
