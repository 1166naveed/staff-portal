exports.handler = async function (event) {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbzYwnjDR3s97mfl7TG3HSxRw1zpfy-N9DVMXsluE2o7COg9pFZq-WcQZQ1MBMQPZfPQpg/exec";

  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: event.body
    });

    const text = await response.text();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: text
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        ok: false,
        message: "Proxy error"
      })
    };
  }
};
