export function trace({ lib, count, bytes, origBytes, values, text }) {
    return {
        x: ['Size (MiB)', 'Latency (ms)'],
        y: values,
        type: 'bar',
        text: values.map(String),
        hovertext: text,
        textposition: 'auto',
        name: `${lib}, orig ${origBytes} MiB, actual ${bytes} MiB`
    };
}

export function layout() {
    return {
        title: "Logarithmic",
        xaxis: {
            tickangle: -45
        },
        yaxis: {
            type: 'log',
            autorange: true
        },
        barmode: 'group'
    };
}