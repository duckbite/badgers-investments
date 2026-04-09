exports.handler = async function handler(event) {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      ok: true,
      message: "Badgers Investments API (placeholder).",
      requestId: event?.requestContext?.requestId ?? null
    })
  };
};

