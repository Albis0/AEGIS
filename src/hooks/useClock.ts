import {useState, useEffect} from "react";

export function useClock(): Date {
    const [clock, setClock] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    return clock;
}
