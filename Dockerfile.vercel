# The official 4.7 CI artifact was built against the RHEL8 VTK / Embree ABI.
# Collect only its runtime libraries; compilers and CUDA are not shipped.
FROM quay.io/pypa/manylinux_2_28_x86_64 AS native-libraries
RUN dnf install -y vtk-devel tbb-devel wget && dnf clean all
RUN wget -q https://github.com/RenderKit/embree/releases/download/v4.4.0/embree-4.4.0.x86_64.linux.tar.gz -O /tmp/embree.tar.gz \
 && mkdir /tmp/embree && tar -xzf /tmp/embree.tar.gz -C /tmp/embree \
 && find /tmp/embree -name 'lib*.so*' -exec cp -L {} /usr/local/lib/ \;
COPY vendor/transport-linux-x64.tar.gz /tmp/transport.tar.gz
RUN mkdir -p /tmp/native /runtime-libs && tar -xzf /tmp/transport.tar.gz -C /tmp/native \
 && LD_LIBRARY_PATH=/usr/local/lib:/usr/lib64 ldd /tmp/native/viennaps/_core*.so > /tmp/linked.txt \
 && ! grep 'not found' /tmp/linked.txt \
 && awk '/=> \// {print $3}' /tmp/linked.txt | grep -Ev '/(libc|libpthread|libdl|librt|libm|libgcc_s|libstdc\+\+)\.so' | xargs -I{} cp -L {} /runtime-libs/

FROM node:22-bookworm-slim AS node-runtime
FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libx11-6 libgomp1 libfreetype6 libglu1-mesa \
 && rm -rf /var/lib/apt/lists/*
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=native-libraries /runtime-libs/ /opt/transport-libs/
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY vendor/transport-linux-x64.tar.gz /tmp/transport.tar.gz
RUN mkdir /opt/transport && tar -xzf /tmp/transport.tar.gz -C /opt/transport && rm /tmp/transport.tar.gz
COPY . .
ENV HOST=0.0.0.0 PORT=80 SIMULATION_SYNC=1 SIMULATION_PYTHON=/usr/local/bin/python SIMULATION_NATIVE_ROOT=/opt/transport \
    PYTHONIOENCODING=utf-8 PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=1 LD_LIBRARY_PATH=/opt/transport-libs
RUN SIMULATION_DOPING_ENGINE=1 python -c "import native_runtime; import viennaps as ps; ps.setDimension(2); assert hasattr(ps,'IonImplantation'); print('transport ready')"
RUN useradd -m simulator && mkdir -p /app/.runtime && chown simulator:simulator /app/.runtime
USER simulator
EXPOSE 80
CMD ["node","server.cjs"]
