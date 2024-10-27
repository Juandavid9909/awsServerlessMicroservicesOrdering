const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { PutItemCommand, QueryCommand, ScanCommand } = require("@aws-sdk/client-dynamodb");

const { ddbClient } = require("./ddbClient");

exports.handler = async(event) => {
    const eventType = event["detail-type"];

    if (eventType !== undefined) {
        return await eventBridgeInvocation(event);
    }

    return await apiGatewayInvocation(event);
};

const eventBridgeInvocation = async(event) => {
    await createOrder(event.detail);
};

const createOrder = async(basketCheckoutEvent) => {
    try {
        const orderDate = new Date().toISOString();

        basketCheckoutEvent.orderDate = orderDate;

        const params = {
            TableName: process.env.DYNAMODB_TABLE_NAME,
            Item: marshall(basketCheckoutEvent || {})
        };

        const createResult = await ddbClient.send(new PutItemCommand(params));

        console.log(createResult);

        return createResult;
    } catch (error) {
        console.error(error);

        throw error;
    }
};

const apiGatewayInvocation = async(event) => {
    let body;

    try {
        switch (event.httpMethod) {
            case "GET":
                if (event.pathParameters != null) {
                    body = await getOrder(event);
                } else {
                    body = await getAllOrders();
                }

                break;

            default:
                throw new Error(`Unsupported route: "${event.httpMethod}"`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Successfully finished operation: "${event.httpMethod}"`,
                body
            })
        };
    } catch (error) {
        console.error(error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Failed to perform operation",
                errorMsg: e.message,
                errorStack: e.stack
            })
        };
    }
};

const getOrder = async(event) => {
    try {
        const userName = event.pathParameters.userName;
        const oderDate = event.queryStringParameters.orderDate;

        const params = {
            KeyConditionExpression: "userName = :userName and orderDate = :orderDate",
            ExpressionAttributeValues: {
                ":userName": { S: userName },
                ":orderDate": { S: orderDate }
            },
            TableName: process.env.DYNAMODB_TABLE_NAME
        };

        const { Items } = await ddbClient.send(new QueryCommand(params));

        console.log(Items);

        return Items.map((item) => unmarshall(item));
    } catch (error) {
        console.error(error);

        throw error;
    }
};

const getAllOrders = async() => {
    try {
        const params = {
            TableName: process.env.DYNAMODB_TABLE_NAME
        };

        const { Items } = await ddbClient.send(new ScanCommand(params));

        console.log(Items);

        return Items ? Items.map((item) => unmarshall(item)) : {};
    } catch (error) {
        console.error(error);

        throw error;
    }
};