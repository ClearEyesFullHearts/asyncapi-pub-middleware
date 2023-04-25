module.exports = {
  request: async () => Promise.resolve({
    data: {
      result: 'OK',
    },
    status: 200,
    headers: [],
  }),
};
