function validateParamId(paramId: string | undefined): number {
    if (paramId === undefined || paramId?.length === 0) {
        return -1;
    }

    let numberId: number = 0;

    if (!Number.isNaN(parseInt(paramId))) {
        numberId = parseInt(paramId);
    }

    return numberId;
}

export {validateParamId};