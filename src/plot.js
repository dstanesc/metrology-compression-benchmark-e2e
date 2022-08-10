export function color(lib) {
    let color = 'red';
    switch (lib) {
        case 'json':
            color = 'rgb(49,130,189)';
            break;
        case 'pako':
            color = 'rgb(204,204,204)';
            break;
        case 'lz4':
            color = 'rgb(142,124,195)';
            break;
    }
    return color;
}

export function trace({ lib, count, bytes, origBytes, values, text }) {
    return {
        x: ['Size (MiB)', 'Latency (ms)'],
        y: values,
        type: 'bar',
        text: values.map(String),
        hovertext: text,
        textposition: 'auto',
        // showlegend: false,
        // hoverinfo: 'none',
        name: `${lib} ${origBytes} MiB`,
        marker: {
            //color: color(lib),
            //opacity: 0.5,
        }
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